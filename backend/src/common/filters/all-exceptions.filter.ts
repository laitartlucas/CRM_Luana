import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global de exceções. Garante que erros não tratados nunca vazem
 * stack trace para o cliente e sempre respondam em um formato consistente.
 * Erros de integração externa (WhatsApp/Google) devem ser tratados nos
 * próprios módulos antes de chegar aqui — este filtro é a última rede de
 * segurança, não a estratégia primária de isolamento.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { message: 'Erro interno inesperado.' };

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json(
      typeof body === 'string'
        ? { statusCode: status, message: body }
        : { statusCode: status, ...(body as object) },
    );
  }
}
