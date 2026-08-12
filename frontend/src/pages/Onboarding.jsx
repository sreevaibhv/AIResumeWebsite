import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Page, Card, Button, Field, Input, ChoiceGroup } from "../design-system";
import { prefs } from "../api/client";
import { track, EVENTS } from "../services/analytics";
import { useAuth } from "../contexts/AuthContext";

/**
 * Onboarding — two questions that change how scoring works, and one
 * that does not.
 *
 * Experience and tier are not profile decoration: they become
 * ScanOptions.fresherMode and ScanOptions.tier, which drive
 * TierCalibrationAgent and the score weighting. Asking them once here
 * is what lets the analyse screen collapse to two inputs afterwards.
 *
 * Everything is skippable. A long questionnaire before the product has
 * shown any value is how you lose the user before the first scan.
 */

const EXPERIENCE = [
  { value: "fresher", label: "Fresher" },
  { value: "1-2", label: "1–2 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "5+", label: "5+ years" },
];

const TIERS = ["Startup", "MNC", "PSU", "Government"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const saved = prefs.get();

  const [experience, setExperience] = useState(saved.experience ?? "");
  const [tier, setTier] = useState(saved.tier ?? "");
  const [role, setRole] = useState(saved.targetRole ?? "");

  function finish(skipped) {
    if (!skipped) {
      prefs.set({
        experience: experience || undefined,
        tier: tier || undefined,
        targetRole: role.trim() || undefined,
        // fresherMode is the flag the pipeline actually consumes.
        fresherMode: experience === "fresher",
        onboarded: true,
      });
      track(EVENTS.onboarding_completed, { experience, tier, hasRole: Boolean(role.trim()) });
    } else {
      prefs.set({ onboarded: true });
      track(EVENTS.onboarding_skipped);
    }
    navigate("/app", { replace: true });
  }

  return (
    <Page width="narrow">
      <div>
        <h1 className="ds-h1">Two questions, then you are in</h1>
        <p className="ds-body" style={{ color: "var(--ink-mid)", marginTop: 8 }}>
          {user?.name ? `Welcome, ${user.name}. ` : ""}
          These change how we score you — a fresher is not judged on missing years, and a PSU is
          not scored like a startup.
        </p>
      </div>

      <Card pad="lg">
        <ChoiceGroup
          label="Experience"
          name="experience"
          value={experience}
          onChange={setExperience}
          options={EXPERIENCE}
        />

        <ChoiceGroup
          label="Mostly applying to"
          name="tier"
          value={tier}
          onChange={setTier}
          options={TIERS}
        />

        <Field label="Target role" hint="optional">
          {(a) => (
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Backend Developer"
              {...a}
            />
          )}
        </Field>

        <div style={{ display: "flex", gap: "var(--s-3)", marginTop: "var(--s-4)", flexWrap: "wrap" }}>
          <Button onClick={() => finish(false)}>Continue</Button>
          <Button variant="ghost" onClick={() => finish(true)}>Skip for now</Button>
        </div>
      </Card>
    </Page>
  );
}
