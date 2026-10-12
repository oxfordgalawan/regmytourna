import { z } from "zod";

export const tournamentFormSchema = z.object({
  name: z.string().min(3, "Name is required"),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
  sport: z.string().min(2).default("pickleball"),
  status: z.enum([
    "draft",
    "published",
    "registration_open",
    "registration_closed",
    "in_progress",
    "completed",
    "cancelled",
  ]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  registrationOpensAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  maxCapacity: z.coerce.number().int().positive().optional(),
  entryFeeCents: z.coerce.number().int().min(0),
  currency: z.string().default("PHP"),
  rules: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  isPublic: z.boolean().default(true),
  waitlistEnabled: z.boolean().default(false),
});

export const divisionSchema = z.object({
  name: z.string().min(2),
  format: z.enum(["singles", "doubles", "team"]),
  capacity: z.coerce.number().int().positive().optional(),
  entryFeeCents: z.coerce.number().int().min(0).optional(),
  eligibilityNotes: z.string().optional(),
});

export type TournamentFormInput = z.infer<typeof tournamentFormSchema>;
