import { clerkClient, requireAuth as clerkRequireAuth } from "@clerk/express";
import { prisma } from "../config/prisma.js";
// Clerk-backed auth middleware that also ensures a local user exists and attaches it to req.user
export function requireAuth(roles) {
    const ensureClerk = clerkRequireAuth();
    return async (req, res, next) => {
        // First, ensure a valid Clerk session
        ensureClerk(req, res, async () => {
            try {
                const auth = req.auth;
                const userId = auth?.userId;
                if (!userId) {
                    return res.status(401).json({ error: { message: "Unauthorized" } });
                }
                // Fetch Clerk user to get email
                const cUser = await clerkClient.users.getUser(userId);
                const email = cUser?.primaryEmailAddress?.emailAddress ||
                    cUser?.emailAddresses?.[0]?.emailAddress;
                if (!email) {
                    return res.status(401).json({ error: { message: "Unauthorized" } });
                }
                // Ensure local user exists (create if missing)
                let local = await prisma.users.findUnique({ where: { email } });
                if (!local) {
                    const nameParts = [cUser.firstName, cUser.lastName].filter(Boolean).join(" ").trim();
                    const full_name = nameParts || email;
                    local = await prisma.users.create({
                        data: {
                            email,
                            full_name,
                            role: "patient",
                            image: "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80",
                        },
                    });
                }
                req.user = {
                    id: String(local.id),
                    role: local.role,
                    email: local.email,
                };
                if (roles && !roles.includes(req.user.role)) {
                    return res.status(403).json({ error: { message: "Forbidden" } });
                }
                next();
            }
            catch (e) {
                return res.status(401).json({ error: { message: "Unauthorized" } });
            }
        });
    };
}
