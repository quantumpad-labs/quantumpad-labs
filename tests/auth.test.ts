import test from "node:test";
import assert from "node:assert/strict";
import { origin } from "../src/lib/auth";
test("Vercel public aliases can authenticate with their own sign-in domain", () => {
  const oldOrigin=process.env.APP_ORIGIN,oldVercel=process.env.VERCEL;
  process.env.APP_ORIGIN="https://exaflop.vercel.app/";
  process.env.VERCEL="1";
  try {
    for(const site of ["https://quantumpad.online","https://www.quantumpad.online","https://exaflop.vercel.app"])
      assert.equal(origin(new Request(`${site}/api/auth/challenge`,{headers:{origin:site}})),site);
    for(const site of ["https://evil.example","https://evil.vercel.app","https://quantumpad.online.evil.example","http://quantumpad.online","null"])
      assert.throws(()=>origin(new Request("https://quantumpad.online/api/auth/challenge",{headers:{origin:site}})));
  } finally {
    if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin;
    if(oldVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=oldVercel;
  }
});
test("same-origin browser requests use the external host, not Next internal bind address", () => {
  const old = process.env.APP_ORIGIN;
  delete process.env.APP_ORIGIN;
  try {
    assert.equal(
      origin(
        new Request("http://0.0.0.0:3000/api/search", {
          headers: { host: "localhost:3000", origin: "http://localhost:3000" },
        }),
      ),
      "http://localhost:3000",
    );
    assert.throws(() =>
      origin(
        new Request("http://0.0.0.0:3000/api/search", {
          headers: { host: "localhost:3000", origin: "https://evil.example" },
        }),
      ),
    );
  } finally {
    if (old) process.env.APP_ORIGIN = old;
  }
});
test("configured production origin takes precedence", () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://exaflop.example";
  try {
    assert.equal(
      origin(
        new Request("http://internal/api/search", {
          headers: { host: "internal", origin: "https://exaflop.example" },
        }),
      ),
      "https://exaflop.example",
    );
    assert.throws(() =>
      origin(
        new Request("http://internal/api/search", {
          headers: { origin: "https://other.example" },
        }),
      ),
    );
  } finally {
    if (old) process.env.APP_ORIGIN = old;
    else delete process.env.APP_ORIGIN;
  }
});
