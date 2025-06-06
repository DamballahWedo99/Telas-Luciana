import { jest } from "@jest/globals";

interface S3Command {
  constructor: { name: string };
  input?: any;
}

interface S3Response {
  Contents?: Array<{ Key: string; LastModified?: Date; Size?: number }>;
  Body?: {
    transformToString: () => Promise<string>;
  };
  [key: string]: any;
}

export const mockS3Client = {
  send: jest.fn<(command: S3Command) => Promise<S3Response>>(),
};

export const mockListObjectsV2Command = jest
  .fn()
  .mockImplementation((input: any) => ({
    input,
    constructor: { name: "ListObjectsV2Command" },
  }));

export const mockGetObjectCommand = jest
  .fn()
  .mockImplementation((input: any) => ({
    input,
    constructor: { name: "GetObjectCommand" },
  }));

export const mockPutObjectCommand = jest
  .fn()
  .mockImplementation((input: any) => ({
    input,
    constructor: { name: "PutObjectCommand" },
  }));

export const resetS3Mock = () => {
  mockS3Client.send.mockClear();
  mockListObjectsV2Command.mockClear();
  mockGetObjectCommand.mockClear();
  mockPutObjectCommand.mockClear();

  mockS3Client.send.mockResolvedValue({});
};

export const setupS3MockResponses = {
  listObjects: (response: S3Response) => {
    mockS3Client.send.mockImplementation((command: S3Command) => {
      if (command.constructor.name === "ListObjectsV2Command") {
        return Promise.resolve(response);
      }
      return Promise.resolve({});
    });
  },

  getObject: (response: S3Response) => {
    mockS3Client.send.mockImplementation((command: S3Command) => {
      if (command.constructor.name === "GetObjectCommand") {
        return Promise.resolve(response);
      }
      return Promise.resolve({});
    });
  },

  putObject: (response: S3Response = {}) => {
    mockS3Client.send.mockImplementation((command: S3Command) => {
      if (command.constructor.name === "PutObjectCommand") {
        return Promise.resolve(response);
      }
      return Promise.resolve({});
    });
  },

  error: (error: Error) => {
    mockS3Client.send.mockRejectedValue(error);
  },
};

export const mockS3WithFiles = (
  files: Array<{ Key: string; LastModified?: Date; Size?: number }>
) => {
  setupS3MockResponses.listObjects({ Contents: files });
};

export const mockS3WithData = (data: string) => {
  setupS3MockResponses.getObject({
    Body: {
      transformToString: () => Promise.resolve(data),
    },
  });
};

export const mockS3WithEmpty = () => {
  setupS3MockResponses.listObjects({ Contents: [] });
  setupS3MockResponses.getObject({
    Body: {
      transformToString: () => Promise.resolve("[]"),
    },
  });
};

export const mockS3WithError = (error: Error = new Error("S3 Error")) => {
  setupS3MockResponses.error(error);
};

export const createMockAuth = (overrides: any = {}) => ({
  user: {
    id: "test-user-id",
    email: "admin@test.com",
    role: "ADMIN",
    isActive: true,
    ...overrides,
  },
});

export const createMockDbUser = (overrides: any = {}) => ({
  id: "test-user-id",
  email: "test@test.com",
  password: "hashedpassword",
  role: "USER",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
