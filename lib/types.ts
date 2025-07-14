import type { Request, Response } from "express";

export interface Route {
  method: keyof OpenAPIPath[string];
  path: string;
  handler: (req: Request, res: Response) => void | Promise<void>;
}

// OpenAPI types
export type OpenAPIPathItem = {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
};

export type OpenAPIDocument = {
  paths: {
    [path: string]: OpenAPIPathItem;
  };
  components?: {
    securitySchemes: {
      [key: string]: {
        type: string;
        name: string;
        in: string;
        description?: string;
      };
    };
  };
};

export type OpenAPIPath = {
  [path: string]: {
    get?: OpenAPIOperation;
    post?: OpenAPIOperation;
    put?: OpenAPIOperation;
    delete?: OpenAPIOperation;
    patch?: OpenAPIOperation;
  };
};

export type OpenAPIOperation = {
  tags: string[];
  summary: string;
  description?: string;
  security?: { [key: string]: string[] }[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content: {
      [contentType: string]: OpenAPIContent;
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        [contentType: string]: OpenAPIContent;
      };
    };
  };
};

export type OpenAPIContent = {
  schema: OpenAPISchema;
  examples?: {
    [name: string]: {
      value: unknown;
      summary?: string;
    };
  };
};

export type OpenAPIParameter = {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema: OpenAPISchema;
};

export type OpenAPISchema = {
  type?: string;
  format?: string;
  nullable?: boolean;
  enum?: string[];
  items?: OpenAPISchema;
  properties?: {
    [key: string]: OpenAPISchema;
  };
  required?: string[];
  description?: string;
  oneOf?: OpenAPISchema[];
  example?: unknown;
  minimum?: number;
  maximum?: number;
  default?: unknown;
};

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total_records: number;
  current_page: number;
  total_pages: number;
  next_page: number | null;
  prev_page: number | null;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
