import { StatusCodes } from "http-status-codes";
import request from "supertest";

import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

describe("Replay Endpoints ", () => {
  it("GET /replay?date=DATE - failure", async () => {
    const response = await request(app).get("/replay?date=2025-01-01");
    const result: ServiceResponse = response.body;

    expect(response.statusCode).toEqual(StatusCodes.OK);
    expect(result.success).toBeTruthy();
    expect(result.responseObject).toStrictEqual([]);
    expect(result.message).toEqual("Success!");
  });

  it("GET /replay/htmx?date=DATE - failure", async () => {
    const response = await request(app).get("/replay/htmx?date=2025-01-01");
    const result: ServiceResponse = response.body;

    expect(response.statusCode).toEqual(StatusCodes.OK);
    expect(result.success).toBeFalsy();
    expect(result.responseObject).toBeFalsy();
    expect(result.message).toEqual(undefined);
  });

  it("GET /replay/play/* - failure", async () => {
    const response = await request(app).get("/replay/play/replay/2025-01-01.mkv");
    const result: ServiceResponse = response.body;

    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    expect(result.success).toBeFalsy();
    expect(result.responseObject).toBeFalsy();
    expect(result.message).toEqual("File does not exist!");
  });
});
