import { handle } from './_core';

export const config = { maxDuration: 60 };

export async function POST(request: Request): Promise<Response> {
  return handle(request, process.env);
}
