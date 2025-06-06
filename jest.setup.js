import "whatwg-fetch";

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashedpassword"),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/mail", () => ({
  sendContactEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendNewAccountEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

const mockS3Client = {
  send: jest.fn(),
};

const mockListObjectsV2Command = jest.fn().mockImplementation((input) => ({
  input,
  constructor: { name: "ListObjectsV2Command" },
}));

const mockGetObjectCommand = jest.fn().mockImplementation((input) => ({
  input,
  constructor: { name: "GetObjectCommand" },
}));

const mockPutObjectCommand = jest.fn().mockImplementation((input) => ({
  input,
  constructor: { name: "PutObjectCommand" },
}));

jest.mock("@/lib/s3", () => ({
  s3Client: mockS3Client,
  ListObjectsV2Command: mockListObjectsV2Command,
  GetObjectCommand: mockGetObjectCommand,
  PutObjectCommand: mockPutObjectCommand,
}));

if (!global.Request) {
  global.Request = require("undici").Request;
}
if (!global.Response) {
  global.Response = require("undici").Response;
}
