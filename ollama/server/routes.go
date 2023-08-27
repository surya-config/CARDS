package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gonum.org/v1/gonum/mat"

	"github.com/jmorganca/ollama/api"
	"github.com/jmorganca/ollama/llm"
	"github.com/jmorganca/ollama/vector"
)

var mode string = gin.DebugMode

func init() {
	switch mode {
	case gin.DebugMode:
	case gin.ReleaseMode:
	case gin.TestMode:
	default:
		mode = gin.DebugMode
	}

	gin.SetMode(mode)
}

var loaded struct {
	mu sync.Mutex

	llm        llm.LLM
	Embeddings []vector.Embedding

	expireAt    time.Time
	expireTimer *time.Timer

	digest  string
	options api.Options
}

var defaultSessionDuration = 5 * time.Minute

// load a model into memory if it is not already loaded, it is up to the caller to lock loaded.mu before calling this function
func load(model *Model, reqOpts map[string]interface{}, sessionDuration time.Duration) error {
	opts := api.DefaultOptions()
	if err := opts.FromMap(model.Options); err != nil {
		log.Printf("could not load model options: %v", err)
		return err
	}

	if err := opts.FromMap(reqOpts); err != nil {
		log.Printf("could not merge model options: %v", err)
		return err
	}

	if model.Digest != loaded.digest || !reflect.DeepEqual(loaded.options, opts) {
		if loaded.llm != nil {
			loaded.llm.Close()
			loaded.llm = nil
			loaded.digest = ""
		}

		if model.Embeddings != nil && len(model.Embeddings) > 0 {
			opts.EmbeddingOnly = true // this is requried to generate embeddings, completions will still work
			loaded.Embeddings = model.Embeddings
		}

		llmModel, err := llm.New(model.ModelPath, model.AdapterPaths, opts)
		if err != nil {
			return err
		}

		// set cache values before modifying opts
		loaded.llm = llmModel
		loaded.digest = model.Digest
		loaded.options = opts

		if opts.NumKeep < 0 {
			promptWithSystem, err := model.Prompt(api.GenerateRequest{}, "")
			if err != nil {
				return err
			}

			promptNoSystem, err := model.Prompt(api.GenerateRequest{Context: []int{0}}, "")
			if err != nil {
				return err
			}

			tokensWithSystem := llmModel.Encode(promptWithSystem)
			tokensNoSystem := llmModel.Encode(promptNoSystem)

			opts.NumKeep = len(tokensWithSystem) - len(tokensNoSystem) + 1

			llmModel.SetOptions(opts)
		}
	}
	loaded.expireAt = time.Now().Add(sessionDuration)

	if loaded.expireTimer == nil {
		loaded.expireTimer = time.AfterFunc(sessionDuration, func() {
			loaded.mu.Lock()
			defer loaded.mu.Unlock()

			if time.Now().Before(loaded.expireAt) {
				return
			}

			if loaded.llm == nil {
				return
			}

			loaded.llm.Close()
			loaded.llm = nil
			loaded.digest = ""
		})
	}
	loaded.expireTimer.Reset(sessionDuration)
	return nil
}

func GenerateHandler(c *gin.Context) {
	loaded.mu.Lock()
	defer loaded.mu.Unlock()

	checkpointStart := time.Now()

	var req api.GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	model, err := GetModel(req.Model)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionDuration := defaultSessionDuration // TODO: set this duration from the request if specified
	if err := load(model, req.Options, sessionDuration); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	checkpointLoaded := time.Now()

	embedding := ""
	if model.Embeddings != nil && len(model.Embeddings) > 0 {
		promptEmbed, err := loaded.llm.Embedding(req.Prompt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		// TODO: set embed_top from specified parameters in modelfile
		embed_top := 3
		topK := vector.TopK(embed_top, mat.NewVecDense(len(promptEmbed), promptEmbed), loaded.Embeddings)
		for _, e := range topK {
			embedding = fmt.Sprintf("%s %s", embedding, e.Embedding.Data)
		}
	}

	prompt, err := model.Prompt(req, embedding)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(r api.GenerateResponse) {
			loaded.expireAt = time.Now().Add(sessionDuration)
			loaded.expireTimer.Reset(sessionDuration)

			r.Model = req.Model
			r.CreatedAt = time.Now().UTC()
			if r.Done {
				r.TotalDuration = time.Since(checkpointStart)
				r.LoadDuration = checkpointLoaded.Sub(checkpointStart)
			}

			ch <- r
		}

		if err := loaded.llm.Predict(req.Context, prompt, fn); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	streamResponse(c, ch)
}

func EmbeddingHandler(c *gin.Context) {
	loaded.mu.Lock()
	defer loaded.mu.Unlock()

	var req api.EmbeddingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	model, err := GetModel(req.Model)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := load(model, req.Options, 5*time.Minute); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !loaded.options.EmbeddingOnly {
		c.JSON(http.StatusBadRequest, gin.H{"error": "embedding option must be set to true"})
		return
	}

	embedding, err := loaded.llm.Embedding(req.Prompt)
	if err != nil {
		log.Printf("embedding generation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate embedding"})
		return
	}

	resp := api.EmbeddingResponse{
		Embedding: embedding,
	}
	c.JSON(http.StatusOK, resp)
}

func PullModelHandler(c *gin.Context) {
	var req api.PullRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(r api.ProgressResponse) {
			ch <- r
		}

		regOpts := &RegistryOptions{
			Insecure: req.Insecure,
			Username: req.Username,
			Password: req.Password,
		}

		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		if err := PullModel(ctx, req.Name, regOpts, fn); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	streamResponse(c, ch)
}

func PushModelHandler(c *gin.Context) {
	var req api.PushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(r api.ProgressResponse) {
			ch <- r
		}

		regOpts := &RegistryOptions{
			Insecure: req.Insecure,
			Username: req.Username,
			Password: req.Password,
		}

		ctx := context.Background()
		if err := PushModel(ctx, req.Name, regOpts, fn); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	streamResponse(c, ch)
}

func CreateModelHandler(c *gin.Context) {
	var req api.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(resp api.ProgressResponse) {
			ch <- resp
		}

		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		if err := CreateModel(ctx, req.Name, req.Path, fn); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	streamResponse(c, ch)
}

func DeleteModelHandler(c *gin.Context) {
	var req api.DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := DeleteModel(req.Name); err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model '%s' not found", req.Name)})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
}

func ListModelsHandler(c *gin.Context) {
	var models []api.ListResponseModel
	fp, err := GetManifestPath()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	err = filepath.Walk(fp, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				log.Printf("manifest file does not exist: %s", fp)
				return nil
			}
			return err
		}
		if !info.IsDir() {
			fi, err := os.Stat(path)
			if err != nil {
				log.Printf("skipping file: %s", fp)
				return nil
			}
			path := path[len(fp)+1:]
			slashIndex := strings.LastIndex(path, "/")
			if slashIndex == -1 {
				return nil
			}
			tag := path[:slashIndex] + ":" + path[slashIndex+1:]

			mp := ParseModelPath(tag)
			manifest, err := GetManifest(mp)
			if err != nil {
				log.Printf("skipping file: %s", fp)
				return nil
			}
			model := api.ListResponseModel{
				Name:       mp.GetShortTagname(),
				Size:       manifest.GetTotalSize(),
				ModifiedAt: fi.ModTime(),
			}
			models = append(models, model)
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, api.ListResponse{Models: models})
}

func CopyModelHandler(c *gin.Context) {
	var req api.CopyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := CopyModel(req.Source, req.Destination); err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model '%s' not found", req.Source)})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
}

func Serve(ln net.Listener, origins []string) error {
	config := cors.DefaultConfig()
	config.AllowWildcard = true
	config.AllowOrigins = append(origins, []string{
		"http://localhost",
		"http://localhost:*",
		"https://localhost",
		"https://localhost:*",
		"http://127.0.0.1",
		"http://127.0.0.1:*",
		"https://127.0.0.1",
		"https://127.0.0.1:*",
		"http://0.0.0.0",
		"http://0.0.0.0:*",
		"https://0.0.0.0",
		"https://0.0.0.0:*",
	}...)

	r := gin.Default()
	r.Use(cors.New(config))

	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "Ollama is running")
	})
	r.HEAD("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	r.POST("/api/pull", PullModelHandler)
	r.POST("/api/generate", GenerateHandler)
	r.POST("/api/embeddings", EmbeddingHandler)
	r.POST("/api/create", CreateModelHandler)
	r.POST("/api/push", PushModelHandler)
	r.POST("/api/copy", CopyModelHandler)
	r.GET("/api/tags", ListModelsHandler)
	r.DELETE("/api/delete", DeleteModelHandler)

	log.Printf("Listening on %s", ln.Addr())
	s := &http.Server{
		Handler: r,
	}

	return s.Serve(ln)
}

func streamResponse(c *gin.Context, ch chan any) {
	c.Header("Content-Type", "application/x-ndjson")
	c.Stream(func(w io.Writer) bool {
		val, ok := <-ch
		if !ok {
			return false
		}

		bts, err := json.Marshal(val)
		if err != nil {
			log.Printf("streamResponse: json.Marshal failed with %s", err)
			return false
		}

		bts = append(bts, '\n')
		if _, err := w.Write(bts); err != nil {
			log.Printf("streamResponse: w.Write failed with %s", err)
			return false
		}

		return true
	})
}
