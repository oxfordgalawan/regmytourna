"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types/database";
import { PlaceSearchCombobox, type PlaceSelection } from "@/components/places/place-search-combobox";
import { AvatarUpload } from "@/components/settings/avatar-upload";

export function ProfileForm({
  userId,
  profile,
  email,
}: {
  userId: string;
  profile: Profile | null;
  email: string;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [place, setPlace] = useState<PlaceSelection | null>(
    profile?.place_psgc_code && profile?.place_label
      ? { psgcCode: profile.place_psgc_code, label: profile.place_label }
      : null
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const dirty =
    fullName !== (profile?.full_name ?? "") ||
    phone !== (profile?.phone ?? "") ||
    place?.psgcCode !== (profile?.place_psgc_code ?? null) ||
    place?.label !== (profile?.place_label ?? null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      toast.error("Couldn't save your profile. Please sign in again.");
      return;
    }
    setSaving(true);
    const result = await updateProfile({
      fullName,
      phone: phone || null,
      placePsgcCode: place?.psgcCode ?? null,
      placeLabel: place?.label ?? null,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error === "Full name is required." ? result.error : "Couldn't save your profile. Please try again.");
    } else {
      toast.success("Profile saved");
      router.refresh();
    }
  }

  const displayName = profile?.full_name?.trim() || email;

  return (
    <form onSubmit={save} className="grid max-w-xl gap-5 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>Profile photo</Label>
        <AvatarUpload
          userId={userId}
          displayName={displayName}
          email={email}
          avatarUrl={profile?.avatar_url}
          variant="inline"
        />
        <p className="text-xs text-muted-foreground">Shown on your account menu and to partners.</p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+63 9XX XXX XXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <PlaceSearchCombobox
          key={profile?.place_psgc_code ?? "none"}
          value={place}
          onChange={setPlace}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving || !dirty}>
          {saving && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
