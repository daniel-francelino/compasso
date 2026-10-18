import { UserRound } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextField } from "@/components/shared/admin/form-fields";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { type ContactRow, saveClientContact } from "@/lib/marketing/clients/clients.functions";
import { saveContactSchema } from "@/lib/marketing/clients/schemas";

export function ContactDialog({
  clientId,
  contact,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string;
  contact?: ContactRow | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [roleTitle, setRoleTitle] = useState(contact?.roleTitle ?? "");
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={UserRound}
      title={contact ? "Editar contato" : "Novo contato"}
      description="Contatos são pessoas do cliente. Eles só acessam o portal se forem convidados."
      submitLabel="Salvar"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveContactSchema,
            {
              ...(contact ? { id: contact.id } : {}),
              clientId,
              name,
              email,
              phone,
              roleTitle,
              isPrimary,
            },
            (data) => saveClientContact({ data }),
            () => {
              onSaved();
              onOpenChange(false);
            },
          );
        },
      }}
    >
      <TextField
        id="contact-name"
        label="Nome"
        required
        value={name}
        onValueChange={setName}
        maxLength={120}
        error={errors["name"]}
      />
      <TextField
        id="contact-email"
        label="E-mail"
        type="email"
        value={email}
        onValueChange={setEmail}
        error={errors["email"]}
      />
      <TextField
        id="contact-phone"
        label="Telefone"
        type="tel"
        value={phone}
        onValueChange={setPhone}
        maxLength={40}
        error={errors["phone"]}
      />
      <TextField
        id="contact-role"
        label="Cargo"
        value={roleTitle}
        onValueChange={setRoleTitle}
        maxLength={80}
        error={errors["roleTitle"]}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="contact-primary"
          checked={isPrimary}
          onCheckedChange={(checked) => setIsPrimary(checked === true)}
        />
        <Label htmlFor="contact-primary">Contato principal</Label>
      </div>
      <FormError message={error} />
    </FormDialog>
  );
}
