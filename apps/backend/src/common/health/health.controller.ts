import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponse, HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: 'PostgreSQL and Redis are reachable',
    schema: {
      example: { status: 'ok' },
    },
  })
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
