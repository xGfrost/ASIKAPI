import { z } from "zod";

export const createSpecialtySchema = z.object({
  name: z.string().min(1),
});

export const assignSpecialtiesSchema = z.object({
  // terima angka atau string angka -> dicoerce ke number
  specialty_ids: z.array(z.coerce.number().int()).min(1, "specialty_ids is required"),
});
