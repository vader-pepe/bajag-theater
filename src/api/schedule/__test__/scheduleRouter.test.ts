import { StatusCodes } from "http-status-codes";
import request from "supertest";

import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

describe("Schedule Endpoints ", () => {
  it("GET /schedule - success", async () => {
    const response = await request(app).get("/schedule");
    const result: ServiceResponse = response.body;

    expect(response.statusCode).toEqual(StatusCodes.OK);
    expect(result.success).toBeTruthy();
    expect(result.responseObject).toBeTruthy();
    expect(result.message).toEqual("Successfully grab theater schedule!");
  });

  it("GET /schedule/htmx - success", async () => {
    const response = await request(app).get("/schedule/htmx");
    const result: ServiceResponse = response.body;

    expect(response.statusCode).toEqual(StatusCodes.OK);
    expect(result.success).toBe(undefined);
    expect(result.responseObject).toBe(undefined);
    expect(result.message).toBe(undefined);
  });
});
