"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  helpCenterInputSchema,
  type HelpCenterInput,
} from "@/lib/validation/help-center";
import { useSession } from "@/lib/auth/client";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export interface HelpCenterDialogProps {
  trigger?: React.ReactNode;
}

export function HelpCenterDialog({ trigger }: HelpCenterDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { data: session } = useSession();

  const form = useForm<HelpCenterInput>({
    resolver: zodResolver(helpCenterInputSchema),
    defaultValues: {
      email: "",
      message: "",
    },
  });

  // Prefill email from the better-auth client session if one exists
  React.useEffect(() => {
    if (session?.user?.email && !form.getValues("email")) {
      form.setValue("email", session.user.email);
    }
  }, [session?.user?.email, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setStatus("idle");
      setErrorMessage(null);
      if (session?.user?.email && !form.getValues("email")) {
        form.setValue("email", session.user.email);
      }
    }
  };

  async function onSubmit(values: HelpCenterInput) {
    setStatus("idle");
    setErrorMessage(null);

    try {
      await orpc.support.helpCenterSubmit(values);
      setStatus("success");
      form.reset({
        email: session?.user?.email ?? "",
        message: "",
      });
    } catch (err: unknown) {
      setStatus("error");
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "UNAUTHORIZED"
      ) {
        setErrorMessage("You must be signed in to submit a support request.");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to send message. Please try again.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Help</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help Center</DialogTitle>
          <DialogDescription>
            Send us a message and our team will get back to you.
          </DialogDescription>
        </DialogHeader>

        {status === "success" && (
          <div className="rounded-md bg-muted p-3 text-sm text-foreground">
            <p className="font-medium text-emerald-600 dark:text-emerald-400">
              Message sent successfully!
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Thank you for reaching out. We will review your message shortly.
            </p>
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="How can we help?"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
