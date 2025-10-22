import { prisma } from "../config/prisma.js";
import { authSchema } from "../validators/auth.schema.js";
// Login-or-register by email only
export async function auth(req, res) {
    const { email, full_name, phone } = authSchema.parse(req.body);
    // Try to find existing user
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
        return res.json({ success: true, user: existing });
    }
    const newUser = await prisma.users.create({
        data: {
            email,
            image: "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80",
            full_name,
            phone,
            role: "patient",
        },
    });
    return res.status(201).json({ success: true, user: newUser });
}
