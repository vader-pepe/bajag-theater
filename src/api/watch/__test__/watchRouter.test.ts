import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";
import { StatusCodes } from "http-status-codes";
import request from "supertest";

describe("Watch Endpoints ", () => {
  it("GET /watch - success", async () => {
    const response = await request(app).get("/watch");
    const result: ServiceResponse = response.body;

    expect(response.statusCode).toEqual(StatusCodes.OK);
    expect(result.success).toBe(undefined);
    expect(result.responseObject).toBe(undefined);
    expect(result.message).toBe(undefined);
  });
});
