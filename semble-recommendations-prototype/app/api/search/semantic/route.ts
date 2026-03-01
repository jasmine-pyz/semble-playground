import { NextRequest, NextResponse } from "next/server";

const SEMBLE_API = "https://api.semble.so";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();

  const url = `${SEMBLE_API}/api/search/semantic?${queryString}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Semble API error (${response.status}):`, errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error calling Semble API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search" },
      { status: 500 }
    );
  }
}
