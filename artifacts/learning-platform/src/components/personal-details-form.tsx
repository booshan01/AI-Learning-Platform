import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getGetLearningPersonalProfileQueryKey,
  useDeleteLearningPersonalProfile,
  useGetLearningPersonalProfile,
  useRequestAddressProofUpload,
  useUpdateLearningPersonalProfile,
} from "@workspace/api-client-react";
import type {
  LearningPersonalProfile,
  LearningPersonalProfileUpdate,
} from "@workspace/api-client-react";

type FormValues = {
  fullLegalName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  genderSex: string;
  nationalityCitizenship: string;
  permanentAddress: string;
  currentResidentialAddress: string;
  maritalStatus: LearningPersonalProfile["maritalStatus"];
  educationalQualifications: string;
};

const emptyForm: FormValues = {
  fullLegalName: "",
  dateOfBirth: "",
  placeOfBirth: "",
  genderSex: "",
  nationalityCitizenship: "",
  permanentAddress: "",
  currentResidentialAddress: "",
  maritalStatus: null,
  educationalQualifications: "",
};

const textFields: {
  name:
    | "fullLegalName"
    | "placeOfBirth"
    | "genderSex"
    | "nationalityCitizenship";
  label: string;
  maxLength: number;
}[] = [
  { name: "fullLegalName", label: "Full legal name", maxLength: 150 },
  { name: "placeOfBirth", label: "Place of birth", maxLength: 150 },
  { name: "genderSex", label: "Gender / sex", maxLength: 80 },
  {
    name: "nationalityCitizenship",
    label: "Nationality / citizenship",
    maxLength: 120,
  },
];

function formFromProfile(profile: LearningPersonalProfile): FormValues {
  return {
    fullLegalName: profile.fullLegalName ?? "",
    dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
    placeOfBirth: profile.placeOfBirth ?? "",
    genderSex: profile.genderSex ?? "",
    nationalityCitizenship: profile.nationalityCitizenship ?? "",
    permanentAddress: profile.permanentAddress ?? "",
    currentResidentialAddress: profile.currentResidentialAddress ?? "",
    maritalStatus: profile.maritalStatus,
    educationalQualifications: profile.educationalQualifications ?? "",
  };
}

function optionalText(value: string): string | null {
  return value.trim() || null;
}

function fileContentType(file: File): "application/pdf" | "image/jpeg" | "image/png" | null {
  const byExtension = file.name.toLowerCase().split(".").pop();
  if (file.type === "application/pdf" || byExtension === "pdf") {
    return "application/pdf";
  }
  if (
    file.type === "image/jpeg" ||
    byExtension === "jpg" ||
    byExtension === "jpeg"
  ) {
    return "image/jpeg";
  }
  if (file.type === "image/png" || byExtension === "png") return "image/png";
  return null;
}

export default function PersonalDetailsForm() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const profileQueryKey = [
    ...getGetLearningPersonalProfileQueryKey(),
    user?.id ?? "signed-out",
  ] as const;
  const profileQuery = useGetLearningPersonalProfile({
    query: {
      queryKey: profileQueryKey,
      enabled: Boolean(user?.id),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const updateProfile = useUpdateLearningPersonalProfile();
  const deleteProfile = useDeleteLearningPersonalProfile();
  const requestUpload = useRequestAddressProofUpload();
  const fileInput = useRef<HTMLInputElement>(null);
  const loadedOwner = useRef<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [uploadedObjectPath, setUploadedObjectPath] = useState<
    string | null | undefined
  >(undefined);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!profileQuery.data || !user?.id || loadedOwner.current === user.id) {
      return;
    }
    loadedOwner.current = user.id;
    setForm(formFromProfile(profileQuery.data));
    setUploadedObjectPath(undefined);
    setUploadedFileName("");
  }, [profileQuery.data, user?.id]);

  const setField = <K extends keyof FormValues>(
    key: K,
    value: FormValues[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus("");
    setErrorMessage("");
  };

  const onUploadFile = async (file: File | undefined) => {
    if (!file) return;
    setErrorMessage("");
    setStatus("");
    const contentType = fileContentType(file);
    if (!contentType) {
      setErrorMessage("Choose a PDF, JPEG, or PNG document.");
      return;
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      setErrorMessage("The document must be smaller than 10 MB.");
      return;
    }

    try {
      const upload = await requestUpload.mutateAsync({
        data: {
          name: file.name.slice(0, 160),
          sizeBytes: file.size,
          contentType,
        },
      });
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!response.ok) {
        throw new Error("The private document upload did not complete.");
      }
      setUploadedObjectPath(upload.objectPath);
      setUploadedFileName(file.name.slice(0, 160));
      setStatus("Document uploaded privately. Save changes to attach it to your profile.");
    } catch {
      setErrorMessage(
        "The document could not be uploaded. Your existing profile has not changed.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const saveProfile = () => {
    if (!form.dateOfBirth) {
      setErrorMessage("");
    } else if (form.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setErrorMessage("Date of birth cannot be in the future.");
      return;
    }
    setStatus("");
    setErrorMessage("");
    const data: LearningPersonalProfileUpdate = {
      fullLegalName: optionalText(form.fullLegalName),
      dateOfBirth: form.dateOfBirth || null,
      placeOfBirth: optionalText(form.placeOfBirth),
      genderSex: optionalText(form.genderSex),
      nationalityCitizenship: optionalText(form.nationalityCitizenship),
      permanentAddress: optionalText(form.permanentAddress),
      currentResidentialAddress: optionalText(form.currentResidentialAddress),
      maritalStatus: form.maritalStatus,
      educationalQualifications: optionalText(form.educationalQualifications),
      ...(uploadedObjectPath !== undefined
        ? { addressProofObjectPath: uploadedObjectPath }
        : {}),
      ...(uploadedObjectPath
        ? { addressProofFileName: uploadedFileName }
        : {}),
    };

    updateProfile.mutate(
      { data },
      {
        onSuccess: (profile) => {
          queryClient.setQueryData(profileQueryKey, profile);
          setForm(formFromProfile(profile));
          setUploadedObjectPath(undefined);
          setUploadedFileName("");
          setStatus("Your personal details are saved securely.");
        },
        onError: () => {
          setErrorMessage("Could not save your details. Your saved profile is unchanged.");
        },
      },
    );
  };

  const removeProofDocument = () => {
    setUploadedObjectPath(null);
    setUploadedFileName("");
    setStatus("The document will be removed when you save your changes.");
    setErrorMessage("");
  };

  const downloadProofDocument = async () => {
    setIsDownloading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/learning/personal-profile/address-proof", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Download failed.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        profileQuery.data?.proofOfAddressDocument?.fileName ??
        "proof-of-address";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setErrorMessage("The proof document could not be downloaded.");
    } finally {
      setIsDownloading(false);
    }
  };

  const clearProfile = () => {
    if (
      !window.confirm(
        "Delete all saved personal details and the proof-of-address document? This cannot be undone.",
      )
    ) {
      return;
    }
    deleteProfile.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(profileQueryKey, {
          ...emptyForm,
          proofOfAddressDocument: null,
        });
        loadedOwner.current = user?.id ?? null;
        setForm(emptyForm);
        setUploadedObjectPath(undefined);
        setUploadedFileName("");
        setStatus("Your personal details and proof document were deleted.");
        setErrorMessage("");
      },
      onError: () => {
        setErrorMessage("Could not delete the saved profile. Please try again.");
      },
    });
  };

  const isBusy =
    updateProfile.isPending ||
    requestUpload.isPending ||
    deleteProfile.isPending;
  const existingProof = profileQuery.data?.proofOfAddressDocument;
  const hasSavedDetails = Boolean(
    profileQuery.data &&
      Object.entries(profileQuery.data).some(
        ([key, value]) => key !== "proofOfAddressDocument" && value !== null,
      ),
  );

  return (
    <section
      aria-labelledby="personal-details-heading"
      className="rounded-[24px] border border-card-border bg-card p-5 sm:p-7"
      data-testid="section-personal-details"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <LockKeyhole size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="personal-details-heading"
              className="font-display text-xl font-bold tracking-[-.035em]"
            >
              Personal details
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-primary">
              <ShieldCheck size={13} />
              Encrypted and private
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            These fields are optional. Only add details you need to keep in this account.
          </p>

          {profileQuery.isLoading ? (
            <div
              className="mt-6 h-40 animate-pulse rounded-2xl bg-muted"
              aria-label="Loading personal details"
            />
          ) : profileQuery.isError ? (
            <div role="alert" className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
              <p className="text-sm font-semibold">Personal details could not be loaded.</p>
              <button
                type="button"
                onClick={() => void profileQuery.refetch()}
                className="mt-2 text-xs font-bold text-primary underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {textFields.map((field) => (
                  <label key={field.name} className="space-y-1.5 text-xs font-semibold">
                    <span>{field.label}</span>
                    <input
                      type="text"
                      maxLength={field.maxLength}
                      value={form[field.name] ?? ""}
                      onChange={(event) => setField(field.name, event.currentTarget.value)}
                      autoComplete="off"
                      data-testid={`input-personal-${field.name}`}
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                ))}
                <label className="space-y-1.5 text-xs font-semibold">
                  <span>Date of birth</span>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.dateOfBirth ?? ""}
                    onChange={(event) => setField("dateOfBirth", event.currentTarget.value)}
                    data-testid="input-personal-date-of-birth"
                    className="min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  <span>Marital status</span>
                  <select
                    value={form.maritalStatus ?? ""}
                    onChange={(event) =>
                      setField(
                        "maritalStatus",
                        (event.currentTarget.value || null) as FormValues["maritalStatus"],
                      )
                    }
                    data-testid="select-personal-marital-status"
                    className="min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Not provided</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="separated">Separated</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold">
                  <span>Permanent address</span>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={form.permanentAddress ?? ""}
                    onChange={(event) => setField("permanentAddress", event.currentTarget.value)}
                    data-testid="input-personal-permanent-address"
                    className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  <span>Current residential address</span>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={form.currentResidentialAddress ?? ""}
                    onChange={(event) =>
                      setField("currentResidentialAddress", event.currentTarget.value)
                    }
                    data-testid="input-personal-current-address"
                    className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold sm:col-span-2">
                  <span>Educational qualifications</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.educationalQualifications ?? ""}
                    onChange={(event) =>
                      setField("educationalQualifications", event.currentTarget.value)
                    }
                    data-testid="input-personal-education"
                    className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <FileText size={17} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Proof of address document</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Private PDF, JPEG, or PNG upload. Maximum 10 MB.
                    </p>
                    {existingProof && uploadedObjectPath === undefined && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {existingProof.fileName} · {Math.ceil(existingProof.sizeBytes / 1024)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => void downloadProofDocument()}
                          disabled={isDownloading}
                          data-testid="button-download-proof"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 font-semibold hover:bg-muted disabled:opacity-50"
                        >
                          <Download size={13} />
                          {isDownloading ? "Downloading…" : "Download"}
                        </button>
                        <button
                          type="button"
                          onClick={removeProofDocument}
                          data-testid="button-remove-proof"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-destructive hover:bg-destructive/5"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      </div>
                    )}
                    {uploadedObjectPath && (
                      <p className="mt-3 text-xs font-semibold text-primary">
                        Ready to attach: {uploadedFileName}
                      </p>
                    )}
                    {uploadedObjectPath === null && (
                      <p className="mt-3 text-xs font-semibold text-destructive">
                        Existing document will be deleted when saved.
                      </p>
                    )}
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) => void onUploadFile(event.currentTarget.files?.[0])}
                      className="sr-only"
                      tabIndex={-1}
                      aria-label="Choose proof of address document"
                    />
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={isBusy}
                      data-testid="button-upload-proof"
                      className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-xs font-bold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                    >
                      <Upload size={14} />
                      {requestUpload.isPending ? "Preparing upload…" : "Choose document"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/15 bg-primary/[.045] p-4">
                <p className="text-xs font-bold">Privacy and security</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Profile details are encrypted at rest with AES-256-GCM and are not sent to the AI coach.
                  Proof documents stay in private storage and downloads require your signed-in account.
                  No Aadhaar, SSN, or government ID number is collected here.
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  These controls do not certify legal compliance. GDPR and applicable local data-protection
                  laws may also require a lawful basis, clear notice, retention limits, access and deletion
                  processes, and a jurisdiction-specific review.
                </p>
              </div>

              {(status || errorMessage) && (
                <p
                  role={errorMessage ? "alert" : "status"}
                  aria-live="polite"
                  data-testid="status-personal-profile"
                  className={`text-xs ${errorMessage ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {errorMessage || status}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={clearProfile}
                  disabled={isBusy || !hasSavedDetails}
                  data-testid="button-delete-personal-profile"
                  className="min-h-10 rounded-xl px-3 text-left text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete saved personal details
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isBusy || profileQuery.isError}
                  data-testid="button-save-personal-profile"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {updateProfile.isPending
                    ? "Saving securely…"
                    : requestUpload.isPending
                      ? "Preparing upload…"
                      : deleteProfile.isPending
                        ? "Deleting…"
                        : "Save personal details"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}