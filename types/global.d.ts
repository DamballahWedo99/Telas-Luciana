declare global {
  var mockS3Response: (commandName: string, response: any) => void;
  var mockS3Error: () => void;
}

export {};
