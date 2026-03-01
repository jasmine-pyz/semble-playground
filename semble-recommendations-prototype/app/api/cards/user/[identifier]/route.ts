import { NextRequest, NextResponse } from "next/server";

const SEMBLE_API = "https://api.semble.so";

export async function GET(
  request: NextRequest,
  { params }: { params: { identifier: string } }
) {
  const { identifier } = await params;
  const searchParams = request.nextUrl.searchParams;

  const queryString = searchParams.toString();
  const url = `${SEMBLE_API}/api/cards/user/${identifier}${
    queryString ? `?${queryString}` : ""
  }`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("Response status:", response.status);
    console.log("Response data:", data);

    if (!response.ok) {
      console.error("Semble API error:", data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Semble API" },
      { status: 500 }
    );
  }
}
