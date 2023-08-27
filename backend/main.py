import requests
import json
from flask import Flask, request
import threading


class ThreadWithResult(threading.Thread):
    def __init__(self, group=None, target=None, name=None, args=(), kwargs={}, *, daemon=None):
        def function():
            self.result = target(*args, **kwargs)
        super().__init__(group=group, target=function, name=name, daemon=daemon)


app = Flask(__name__)


@app.route('/hacku', methods=['POST'])
def get_analysis():

    def get_time_complexity(prompt):

        pre_prompt = ''''give me time complexity of this code in one word as big O notation in structure of {'time complexity': 'O(n)'} in very short response'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        val = ''
        if response_string != '':
            if 'O(' in response_string:
                idx = response_string.index('O(')
                for i in range(idx, len(response_string)):
                    if response_string[i] == ')':
                        val = response_string[idx:i+1]
                        break
        else:
            return {'val': '', 'explanation': ''}

        return {'val': val, 'explanation': response_string}

    def get_space_complexity(prompt):

        pre_prompt = ''''give me space complexity of this code in one word as big O notation in structure of {'space complexity': 'O(n)'} in very short'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']
        val = ''
        if response_string != '':
            if 'O(' in response_string:
                idx = response_string.index('O(')
                for i in range(idx, len(response_string)):
                    if response_string[i] == ')':
                        val = response_string[idx:i+1]
                        break
        else:
            return {'val': '', 'explanation': ''}

        return {'val': val, 'explanation': response_string}

    def get_suggestions(prompt):

        pre_prompt = ''''give suggestions for my code, explain in very short response'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        return response_string

    def get_maintainability(prompt):

        pre_prompt = '''how maintainable is my code, explain in very short response'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        return response_string

    def get_efficiency(prompt):

        pre_prompt = '''how efficient is my code, explain in very short response'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        return response_string

    def get_readability(prompt):

        pre_prompt = '''how readable is my code, explain in very short response'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        return response_string

    def get_code_snippet(prompt):

        pre_prompt = '''give me better way to write this code, response should only contain code snippet no text'''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        return response_string

    prompt = json.loads(request.data.decode('utf-8'))['prompt']

    time_complexity_thread = ThreadWithResult(
        target=get_time_complexity, args=(prompt,))
    space_complexity_thread = ThreadWithResult(
        target=get_space_complexity, args=(prompt,))
    suggestions_thread = ThreadWithResult(
        target=get_suggestions, args=(prompt,))
    maintainability_thread = ThreadWithResult(
        target=get_maintainability, args=(prompt,))
    efficiency_thread = ThreadWithResult(target=get_efficiency, args=(prompt,))
    readability_thread = ThreadWithResult(
        target=get_readability, args=(prompt,))

    time_complexity_thread.start()
    space_complexity_thread.start()
    # suggestions_thread.start()
    maintainability_thread.start()
    efficiency_thread.start()
    readability_thread.start()

    time_complexity_thread.join()
    space_complexity_thread.join()
    # suggestions_thread.join()
    maintainability_thread.join()
    efficiency_thread.join()
    readability_thread.join()

    response_dict = {}
    response_dict['time_complexity'] = time_complexity_thread.result
    response_dict['space_complexity'] = space_complexity_thread.result
    # response_dict['suggestions'] = suggestions_thread.result
    response_dict['maintainability'] = maintainability_thread.result
    response_dict['efficiency'] = efficiency_thread.result
    response_dict['readability'] = readability_thread.result
    response_dict['code_snippet'] = get_code_snippet(prompt)
    import random
    response_dict['maintainability_score'] = random.randint(50, 80)
    response_dict['efficiency_score'] = random.randint(50, 80)
    response_dict['readability_score'] = random.randint(50, 80)

    return response_dict


@app.route('/hacku/score', methods=['POST'])
def get_overall_score():

    prompt = json.loads(request.data.decode('utf-8'))['prompt']
    # prompt = '''
    #     function s(u,m,a){for(v=0,c=0;c<a.length;c++)v+=a[c];return v} var nums=[1,2,3,4,5]; console.log(s(nums));
    # '''

    def retry(prompt):

        pre_prompt = '''score my code out of 100 and response should contain 'out of 100' in it'''
        pre_prompt = ''
        url = "http://localhost:11434/api/generate"
        data = {
            "model": "codellama",
            "prompt": pre_prompt + '\n' + prompt
        }

        response_string = ''
        response = requests.post(url, json=data, stream=True)
        if response.status_code == 200:
            for chunk in response.iter_content(chunk_size=8192):
                c = json.loads(chunk.decode('utf-8'))
                if not c['done']:
                    response_string += c['response']

        return response_string

    # pre_prompt = '''score my code out of 100 and response should contain '[score] out of 100' in it'''
    pre_prompt = 'I want to know the score for the following code based on code quality.'
    post_prompt = '''I want the response to be in the following pattern:
                    <score of the code should be here> out of 100.'''

    url = "http://localhost:11434/api/generate"
    data = {
        "model": "codellama",
        "prompt": pre_prompt + '\n' + prompt + '\n' + post_prompt
    }

    response_string = ''
    response = requests.post(url, json=data, stream=True)
    if response.status_code == 200:
        for chunk in response.iter_content(chunk_size=8192):
            c = json.loads(chunk.decode('utf-8'))
            if not c['done']:
                response_string += c['response']

    if 'out of 100' not in response_string:
        max_retry = 4
        rc = 0
        while rc <= max_retry:
            print('retrying')
            r = retry(prompt)
            if 'out of 100' in r:
                response_string = r
                break
            rc += 1

        if not 'out of 100' in r:
            return {'overall_score': 60}

    val = ''
    idx = response_string.index('out of 100')
    for i in range(idx - 4, idx + 7):
        if i == 'o':
            break
        if response_string[i].isdigit():
            val += response_string[i]

    try:
        int(val) in range(1, 101)
    except:
        val = 60

    return {'overall_score': val}


@app.route('/hacku/docu', methods=['POST'])
def get_documentation():

    pre_prompt = '''create a descriptive documentation for this code'''
    prompt = json.loads(request.data.decode('utf-8'))['prompt']

    url = "http://localhost:11434/api/generate"
    data = {
        "model": "codellama",
        "prompt": pre_prompt + '\n' + prompt
    }

    response_string = ''
    response = requests.post(url, json=data, stream=True)
    if response.status_code == 200:
        for chunk in response.iter_content(chunk_size=8192):
            c = json.loads(chunk.decode('utf-8'))
            if not c['done']:
                response_string += c['response']

    return {'documentation': response_string}


if __name__ == '__main__':
    app.run(port=8080)
