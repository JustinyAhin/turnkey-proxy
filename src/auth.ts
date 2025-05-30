import { config } from "dotenv";
import { Turnkey } from "@turnkey/sdk-server";

config();

const privateKey = process.env.TURNKEY_PRIVATE_KEY;
const publicKey = process.env.TURNKEY_PUBLIC_KEY;
const orgId = process.env.TURNKEY_ORG_ID;

const createTurnkeyClient = () => {
  if (!privateKey || !publicKey || !orgId) {
    console.log("Turnkey credentials are not set");
    return null;
  }

  const turnkey = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: privateKey,
    apiPublicKey: publicKey,
    defaultOrganizationId: orgId,
  });

  return turnkey.apiClient();
};

const decodeJwt = (token: string) => {
  try {
    const b64 = token.split(".")[1];
    const json = Buffer.from(b64, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return {} as Record<string, unknown>;
  }
};

enum FilterType {
  Email = "EMAIL",
  PhoneNumber = "PHONE_NUMBER",
  OidcToken = "OIDC_TOKEN",
  PublicKey = "PUBLIC_KEY",
}

type HandleSnsLoginParams = {
  oidcToken: string;
  indexedDbClientPublicKey: string;
};
const handleSnsLogin = async ({
  oidcToken,
  indexedDbClientPublicKey,
}: HandleSnsLoginParams) => {
  const client = createTurnkeyClient();

  if (!client) {
    console.error("Failed to create Turnkey client");
    return null;
  }

  // Does a sub-org already exist for this Google account?
  const existing = await client.getSubOrgIds({
    filterType: FilterType.OidcToken,
    filterValue: oidcToken,
  });

  let subOrgId: string;

  if (existing?.organizationIds?.length) {
    // Re-use the first existing sub-org ID
    subOrgId = existing.organizationIds[0];
  } else {
    // Otherwise create a fresh sub-org linked to this Google account
    // pull user info from the Google ID-token payload
    const { email, name } = decodeJwt(oidcToken) as {
      email?: string;
      name?: string;
    };

    if (!email) {
      console.error("Google ID-token is missing email claim");
      return null;
    }

    const createResp = await client.createSubOrganization({
      subOrganizationName: `suborg-${Date.now()}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: name ?? email,
          userEmail: email,
          apiKeys: [],
          authenticators: [],
          oauthProviders: [
            {
              providerName: "Google",
              oidcToken,
            },
          ],
        },
      ],
    });

    if (!createResp?.subOrganizationId) {
      console.error("Failed to create sub-organization");
    }

    subOrgId = createResp.subOrganizationId;
  }

  // Issue / refresh the session bound to this browser key
  const { session } = await client.oauthLogin({
    organizationId: subOrgId,
    publicKey: indexedDbClientPublicKey,
    oidcToken,
  });

  if (!session) {
    console.error("Failed to issue / refresh session");
    return null;
  }

  return session;
};

export { handleSnsLogin };
