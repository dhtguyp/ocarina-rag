import { afterEach, describe, expect, it, vi } from "vitest";
import { queryNotes } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("queryNotes", () => {
  it("POSTs base notes and shift as JSON and returns the body", async () => {
    const body = { matches: [], success: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);

    const res = await queryNotes([62, 65, 69, 71, 74, 62], -3);

    expect(res).toEqual(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/query");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ notes: [62, 65, 69, 71, 74, 62], shift: -3 });
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(queryNotes([1, 2, 3, 4, 5, 6], 0)).rejects.toThrow("503");
  });
});
