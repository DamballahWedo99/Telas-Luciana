const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testTimeout: 15000,
  maxWorkers: 1,
  clearMocks: true,
  forceExit: true,
  detectOpenHandles: true,
  maxConcurrency: 1,
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": ["@swc/jest"],
  },
};

module.exports = createJestConfig(customJestConfig);
