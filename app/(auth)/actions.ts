// app/(auth)/actions.ts - Complete file with correct imports

'use server';

import { z } from 'zod';

import { createUser, getUser, updateUserMedicalHistory } from '@/lib/db/queries';

import { auth, signIn } from './auth';

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
  needsMedicalHistory?: boolean;
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: 'user_exists' } as RegisterActionState;
    }
    await createUser(validatedData.email, validatedData.password);
    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: 'success', needsMedicalHistory: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface MedicalHistoryActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const saveMedicalHistory = async (
  _: MedicalHistoryActionState,
  formData: FormData,
): Promise<MedicalHistoryActionState> => {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { status: 'failed' };
    }

    const allergies = formData.get('allergies') as string;
    const medications = formData.get('medications') as string;
    const conditions = formData.get('conditions') as string;
    const familyHistory = formData.get('familyHistory') as string;

    // Create a structured medical history object
    const medicalHistory = JSON.stringify({
      allergies,
      medications,
      conditions,
      familyHistory,
    });

    await updateUserMedicalHistory(session.user.id, medicalHistory);

    return { status: 'success' };
  } catch (error) {
    console.error('Failed to save medical history:', error);
    return { status: 'failed' };
  }
};