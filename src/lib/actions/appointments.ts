'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Cierra una cita que ya pasó.
 *
 * Solo el negocio sabe si la persona vino. El agente nunca lo adivina: sin
 * este paso, la tasa de asistencia sería inventada y no serviría para nada.
 *
 * Va por el cliente de sesión, no por el de servicio: así la RLS impide que
 * nadie cierre una cita de otro negocio, aunque manipule el id del formulario.
 */
const schema = z.object({
  appointmentId: z.string().uuid(),
  estado: z.enum(['COMPLETED', 'NO_SHOW']),
});

export async function cerrarCita(formData: FormData) {
  const parsed = schema.safeParse({
    appointmentId: formData.get('appointmentId'),
    estado: formData.get('estado'),
  });

  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('appointments')
    .update({ status: parsed.data.estado })
    .eq('id', parsed.data.appointmentId)
    // Solo se cierra lo que sigue abierto: evita revivir una cancelada.
    .in('status', ['SCHEDULED', 'CONFIRMED']);

  revalidatePath('/panel');
}
