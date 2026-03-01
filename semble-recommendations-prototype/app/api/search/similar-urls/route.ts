import { NextRequest, NextResponse } from "next/server";

const SEMBLE_API = "https://api.semble.so";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();

  const url = `${SEMBLE_API}/api/search/similar-urls?${queryString}`;

  const response = await fetch(url);
  const data = await response.json();

  return NextResponse.json(data);
}
