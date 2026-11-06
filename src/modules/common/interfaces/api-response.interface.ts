export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  data: T;
  message: string;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  statusCode: number;
  data: T[];
  message: string;
  timestamp: string;
  path: string;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

export interface OAuthClient {
  id: string;
  secret: string;
  name: string;
  redirectUris: string[];
  isConfidential: boolean;
}
