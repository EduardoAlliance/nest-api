import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { LoggerService } from '../../../logging/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const messageText =
      typeof message === 'string'
        ? message
        : typeof message === 'object' && message !== null && 'message' in message
          ? (message as any).message
          : 'Internal server error';

    this.logger.error(
      `[${ctx.getRequest().method}] ${ctx.getRequest().url} - ${httpStatus} - ${JSON.stringify(messageText)}`,
      exception instanceof Error ? exception.stack : '',
    );

    const responseBody = {
      success: false,
      statusCode: httpStatus,
      data: null,
      message: Array.isArray(messageText) ? messageText.join(', ') : messageText,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
