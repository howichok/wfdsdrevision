import { createAccessControl } from "better-auth/plugins";

const ac = createAccessControl({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

/** better-auth admin plugin roles — must include every role in adminRoles + defaultRole */
export const authRoles = {
  SA: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "impersonate-admins",
      "delete",
      "set-password",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
  T: ac.newRole({
    user: ["get", "list"],
    session: ["list"],
  }),
  S: ac.newRole({
    user: ["get"],
    session: [],
  }),
  SU: ac.newRole({
    user: [],
    session: [],
  }),
};
