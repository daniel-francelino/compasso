import { useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import { Button } from "@/components/shared/ui/button";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import { newItem, rejectionFor, sendUpload } from "@/hooks/shared/use-media-upload";
import { setAvatar } from "@/lib/shared/auth/profile.functions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind, kindOfMime } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";

const AVATAR_MAX_MB = 5;
const MB = 1024 * 1024;

const problemWith = (file: File): string | null => {
  if (kindOfMime(file.type) !== MediaKind.Image || file.type === "image/svg+xml") {
    return "Escolha uma imagem JPG, PNG ou WebP.";
  }
  if (file.size > AVATAR_MAX_MB * MB) return `A foto passa de ${AVATAR_MAX_MB} MB.`;
  return rejectionFor(file);
};

export function ProfileAvatarField() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const id = auth.profile?.id;
  const name = auth.profile?.name ?? "";
  const url = useAvatarUrls([id])[id ?? ""];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: QueryKey.Avatars.all() });
    await queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
  };

  const upload = async (file: File) => {
    const problem = problemWith(file);
    if (problem !== null) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const sent = await sendUpload(newItem(file), { scope: MediaScope.Profile });
      if (!sent.ok) {
        toast.error(sent.message);
        return;
      }
      const saved = await setAvatar({ data: { versionId: sent.versionId } });
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      await refresh();
      toast.success("Foto de perfil atualizada.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const saved = await setAvatar({ data: { versionId: null } });
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      await refresh();
      toast.success("Foto de perfil removida.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <PersonAvatar name={name} url={url} size="xl" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera aria-hidden="true" />
            {url ? "Trocar foto" : "Enviar foto"}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden="true" />
              Remover foto
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou WebP, até {AVATAR_MAX_MB} MB. Sem foto, aparecem as suas iniciais.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept="image/jpeg,image/png,image/webp"
        aria-label="Escolher foto de perfil"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) void upload(file);
        }}
      />
    </div>
  );
}
