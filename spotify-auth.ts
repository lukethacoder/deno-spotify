import { config } from "https://deno.land/x/dotenv/mod.ts";
import {
  readJson,
  writeJson,
  ensureFile,
} from "https://deno.land/std/fs/mod.ts";
import { opine } from "https://deno.land/x/opine@0.21.3/mod.ts";
import {
  Request,
  Response,
} from "https://deno.land/x/opine@0.21.3/src/types.ts";

const app = opine();
const env = config();

const PORT: number = parseInt(env.PORT) || 3000;
const BASE_API_URL = "https://accounts.spotify.com/api";
const SERVER_ADDRESS = `http://localhost:${PORT}`;
const SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;

let afterLoginURI = `http://localhost:${PORT}/success`;
let access_token = "";
let refresh_token = "";
let expires_in = "";
let loginInitiated = false;

let redirect_uri = `${SERVER_ADDRESS}/callback`;

app.get("/", (req, res) => {
  res.send(
    `<div style="font-family: monospace;">
      <h1>Welcome to Deno Spotify OAuth</h1>
      <p>Please navigate to <a href="/login">/login</a> to continue.</p>
    </div>`,
  );
});

app.get("/login", (req, res) => {
  let login_url = new URL(`https://accounts.spotify.com/authorize?`);

  const body: URLSearchParams = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope:
      "user-read-playback-state user-read-currently-playing user-modify-playback-state user-read-private user-read-email",
    redirect_uri: redirect_uri,
  });

  let auth_url_with_params = login_url + body.toString();
  res.redirect(auth_url_with_params);
});

app.get("/callback", function (req: Request, res: Response) {
  let code = req.query.code || null;

  const body: URLSearchParams = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET,
    code: code,
    redirect_uri: redirect_uri,
    grant_type: "authorization_code",
  });

  fetch(`${BASE_API_URL}/token`, {
    method: "POST",
    headers: {
      contentType: "application/x-www-form-urlencoded",
    },
    body: body,
  })
    .then((response: any) => response.json())
    .then((sp_res: any) => {
      access_token = sp_res.access_token;
      refresh_token = sp_res.refresh_token;
      expires_in = sp_res.expires_in;

      loginInitiated = true;
      res.redirect("/success");
    })
    .catch((err: any) => {
      console.error("err ", err);
      res.redirect("/failed");
    });
});

app.get("/success", function (req: Request, res: Response) {
  res.send(`
    <div style="font-family: monospace;">
      <h1>Successfully OAuthed Spotify</h1>
      <p>access_token: ${access_token}</p>
      <p>refresh_token: ${refresh_token}</p>
      <p>expires_in: ${expires_in}</p>
    </div>
  `);

  writeJson("./token.json", {
    access_token: access_token,
    refresh_token: refresh_token,
    expires_in: expires_in,
  }).then((res) => {
    console.log("res ", res);
  }).catch((err) => {
    console.error("err ", err);
  });
});

app.get("/failed", function (req: Request, res: Response) {
  res.send("Failed to OAuth with Spotify");
});

await ensureFile("./token.json");
try {
  const tokenFile = await readJson("./token.json");
  console.log("tokenFile ", tokenFile);
} catch (err) {
  console.error("err ", err);
}

console.log(
  `Listening on port ${PORT}. Go to ${SERVER_ADDRESS}/login to initiate authentication flow.`,
);
app.listen(PORT);
