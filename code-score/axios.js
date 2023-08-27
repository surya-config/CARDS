const axios = require("axios");

const axiosInstance = axios.default.create({
  baseURL: "http://127.0.0.1:8080",
});

module.exports = {
  axiosInstance,
};
