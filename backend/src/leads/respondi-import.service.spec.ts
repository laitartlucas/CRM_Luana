import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { RespondiImportService } from './respondi-import.service';

function makeService(token: string | undefined = 'tok') {
  const config: any = { get: jest.fn().mockReturnValue(token) };
  const leads: any = { create: jest.fn().mockResolvedValue({}) };
  return { service: new RespondiImportService(config, leads), leads };
}

const answer = (field_title: string, value: string, field_type = 'text') => ({
  field_slug: field_title,
  field_title,
  field_type,
  value,
});

describe('RespondiImportService.handleWebhook', () => {
  it('cria lead mapeando nome, telefone (objeto serializado) e campos de contexto', async () => {
    const { service, leads } = makeService();
    await service.handleWebhook({
      data: {
        answers: [
          answer('Nome completo', 'Maria Souza'),
          answer('WhatsApp', '{"country":"55","phone":"54999990000"}', 'phone'),
          answer('Instagram', '@maria'),
          answer('Cidade:', 'Caxias do Sul'),
          answer('Profissão', 'Advogada'),
          answer('Qual sua maior dificuldade?', '["Não sei me vestir"]', 'radio'),
          answer('O que você deseja?', 'Mais confiança'),
          answer('Tem medo de quê?', 'Investir e não gostar'),
          answer('Como nos conheceu?', 'Indicação'),
        ],
      },
    });

    expect(leads.create).toHaveBeenCalledTimes(1);
    expect(leads.create.mock.calls[0][0]).toMatchObject({
      name: 'Maria Souza',
      phoneE164: '+5554999990000',
      instagram: '@maria',
      city: 'Caxias do Sul',
      profession: 'Advogada',
      painPoints: 'Não sei me vestir',
      desires: 'Mais confiança',
      objections: 'Investir e não gostar',
      leadNotes: 'Como nos conheceu?\nIndicação',
    });
  });

  it('aceita payload sem o envelope data', async () => {
    const { service, leads } = makeService();
    await service.handleWebhook({ answers: [answer('Nome', 'Ana'), answer('Telefone', '54 99999-0000')] });
    expect(leads.create.mock.calls[0][0]).toMatchObject({ name: 'Ana', phoneE164: '+5554999990000' });
  });

  it('não duplica o +55 quando o número já vem com o código do país', async () => {
    const { service, leads } = makeService();
    await service.handleWebhook({ answers: [answer('Nome', 'Ana'), answer('Telefone', '55 54 99999-0000')] });
    expect(leads.create.mock.calls[0][0].phoneE164).toBe('+5554999990000');
  });

  it('ignora payload sem respostas ou sem nome/telefone', async () => {
    const { service, leads } = makeService();
    await service.handleWebhook({});
    await service.handleWebhook({ data: { answers: [answer('Nome', 'Ana')] } });
    expect(leads.create).not.toHaveBeenCalled();
  });
});

describe('RespondiImportService.importFromUrl', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('falha sem token configurado', async () => {
    const { service } = makeService(undefined);
    await expect(service.importFromUrl(`https://x/${uuid}`)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('falha quando o link não tem identificador', async () => {
    const { service } = makeService();
    await expect(service.importFromUrl('https://respondi.app/sem-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('traduz 401 em erro de token expirado', async () => {
    const { service } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false }) as any;
    await expect(service.importFromUrl(`https://x/${uuid}`)).rejects.toThrow(/expirou/);
  });

  it('traduz falha de rede em BadGateway', async () => {
    const { service } = makeService();
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as any;
    await expect(service.importFromUrl(`https://x/${uuid}`)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('retorna os dados mapeados e chama a API com o uuid e o token', async () => {
    const { service } = makeService();
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ data: { answers: [answer('Nome', 'Bia')] } }),
    });
    global.fetch = fetchMock as any;
    const data = await service.importFromUrl(`https://x/${uuid}`);
    expect(data.name).toBe('Bia');
    expect(fetchMock.mock.calls[0][0]).toContain(uuid);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });
});
