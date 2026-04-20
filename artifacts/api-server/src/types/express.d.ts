declare namespace Express {
  interface Request {
    user?: {
      userId: number;
      email: string;
      role: string;
      username?: string;
      name?: string;
    };
  }
}
