import { FastifyRequest, FastifyReply } from 'fastify';
import { SettingsService } from './settings.service';

const service = new SettingsService();

export async function getSettings(_req: FastifyRequest, reply: FastifyReply) {
  const settings = await service.getSettings();
  reply.send({ settings });
}

export async function updateSettings(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  try {
    const updated = await service.updateSettings({
      reminderDaysBefore1: body.reminderDaysBefore1,
      reminderDaysBefore2: body.reminderDaysBefore2,
      reminderDaysBefore3: body.reminderDaysBefore3,
      smsEnabled: body.smsEnabled,
      emailEnabled: body.emailEnabled,
    });
    reply.send({ settings: updated });
  } catch (err: any) {
    reply.status(400).send({ error: { message: err.message, code: 'SETTINGS_ERROR' } });
  }
}
