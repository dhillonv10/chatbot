'use client';
// app/(auth)/medical-history/page.tsx

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { SubmitButton } from '@/components/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { saveMedicalHistory, type MedicalHistoryActionState } from '../actions';

export default function Page() {
  const router = useRouter();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<MedicalHistoryActionState, FormData>(
    saveMedicalHistory,
    {
      status: 'idle',
    },
  );

  useEffect(() => {
    if (state.status === 'failed') {
      toast.error('Failed to save medical history!');
    } else if (state.status === 'invalid_data') {
      toast.error('Failed validating your submission!');
    } else if (state.status === 'success') {
      toast.success('Medical history saved successfully');
      setIsSuccessful(true);
      router.push('/');
    }
  }, [state, router]);

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl gap-12 flex flex-col">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Medical History</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Please provide your medical history to help us provide more personalized medical education.
            <br /><br />
            <strong>Note:</strong> This information is only used to provide context for educational purposes, not for diagnosis.
          </p>
        </div>
        <form action={formAction} className="flex flex-col gap-4 px-4 sm:px-16">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="allergies"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Allergies
            </Label>
            <Textarea
              id="allergies"
              name="allergies"
              className="bg-muted text-md md:text-sm min-h-[100px]"
              placeholder="List any allergies you have..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="medications"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Current Medications
            </Label>
            <Textarea
              id="medications"
              name="medications"
              className="bg-muted text-md md:text-sm min-h-[100px]"
              placeholder="List any medications you are currently taking..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="conditions"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Medical Conditions
            </Label>
            <Textarea
              id="conditions"
              name="conditions"
              className="bg-muted text-md md:text-sm min-h-[100px]"
              placeholder="List any chronic conditions, previous surgeries, etc..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="familyHistory"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Family Medical History
            </Label>
            <Textarea
              id="familyHistory"
              name="familyHistory"
              className="bg-muted text-md md:text-sm min-h-[100px]"
              placeholder="List any significant medical conditions in your family..."
            />
          </div>

          <SubmitButton isSuccessful={isSuccessful}>Save Medical History</SubmitButton>
        </form>
      </div>
    </div>
  );
}