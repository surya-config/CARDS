package llm

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

type ModelFamily string

type ModelType uint32

const (
	ModelType3B  ModelType = 26
	ModelType7B  ModelType = 32
	ModelType13B ModelType = 40
	ModelType34B ModelType = 48
	ModelType30B ModelType = 60
	ModelType65B ModelType = 80
)

func (mt ModelType) String() string {
	switch mt {
	case ModelType3B:
		return "3B"
	case ModelType7B:
		return "7B"
	case ModelType13B:
		return "13B"
	case ModelType34B:
		return "34B"
	case ModelType30B:
		return "30B"
	case ModelType65B:
		return "65B"
	default:
		return "Unknown"
	}
}

type FileType interface {
	String() string
}

type GGML struct {
	magic uint32
	container
	model
}

type model interface {
	ModelFamily() ModelFamily
	ModelType() ModelType
	FileType() FileType
}

type container interface {
	Name() string
	Decode(io.Reader) error
}

type containerGGML struct {
}

func (c *containerGGML) Name() string {
	return "ggml"
}

func (c *containerGGML) Decode(r io.Reader) error {
	return nil
}

type containerGGMF struct {
	version uint32
}

func (c *containerGGMF) Name() string {
	return "ggmf"
}

func (c *containerGGMF) Decode(r io.Reader) error {
	var version uint32
	binary.Read(r, binary.LittleEndian, &version)

	switch version {
	case 1:
	default:
		return errors.New("invalid version")
	}

	c.version = version
	return nil
}

type containerGGJT struct {
	version uint32
}

func (c *containerGGJT) Name() string {
	return "ggjt"
}

func (c *containerGGJT) Decode(r io.Reader) error {
	var version uint32
	binary.Read(r, binary.LittleEndian, &version)

	switch version {
	case 1, 2, 3:
	default:
		return errors.New("invalid version")
	}

	c.version = version
	return nil
}

type containerLORA struct {
	version uint32
}

func (c *containerLORA) Name() string {
	return "ggla"
}

func (c *containerLORA) Decode(r io.Reader) error {
	var version uint32
	binary.Read(r, binary.LittleEndian, &version)

	switch version {
	case 1:
	default:
		return errors.New("invalid version")
	}

	c.version = version
	return nil
}

const (
	// / Magic constant for `ggml` files (unversioned).
	FILE_MAGIC_GGML = 0x67676d6c
	// / Magic constant for `ggml` files (versioned, ggmf).
	FILE_MAGIC_GGMF = 0x67676d66
	// / Magic constant for `ggml` files (versioned, ggjt).
	FILE_MAGIC_GGJT = 0x67676a74
	// / Magic constant for `ggla` files (LoRA adapter).
	FILE_MAGIC_GGLA = 0x67676C61
)

func DecodeGGML(r io.ReadSeeker, hint ModelFamily) (*GGML, error) {
	var ggml GGML
	binary.Read(r, binary.LittleEndian, &ggml.magic)

	switch ggml.magic {
	case FILE_MAGIC_GGML:
		ggml.container = &containerGGML{}
	case FILE_MAGIC_GGMF:
		ggml.container = &containerGGMF{}
	case FILE_MAGIC_GGJT:
		ggml.container = &containerGGJT{}
	case FILE_MAGIC_GGLA:
		ggml.container = &containerLORA{}
	default:
		return nil, errors.New("invalid file magic")
	}

	if err := ggml.Decode(r); err != nil {
		return nil, err
	}

	// different model types may have different layouts for hyperparameters
	switch hint {
	case ModelFamilyLlama:
		var llama llamaModel
		binary.Read(r, binary.LittleEndian, &llama.hyperparameters)
		ggml.model = &llama
		// TODO: sanity check hyperparameters
	default:
		return nil, fmt.Errorf("unsupported model type: %s", hint)
	}

	// final model type
	return &ggml, nil
}
