import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerListResponseDto, CustomerResponseDto } from './dto/customer-response.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { RecordCustomerOutcomeDto } from './dto/record-outcome.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Invalid or expired access token' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @ApiConflictResponse({ description: 'Customer code already exists' })
  async create(@Body() input: CreateCustomerDto): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromRecord(await this.customers.create(input));
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: CustomerListResponseDto })
  async list(@Query() query: ListCustomersQueryDto): Promise<CustomerListResponseDto> {
    const result = await this.customers.list({
      page: query.page,
      limit: query.limit,
      keyword: query.keyword,
      status: query.status,
      doNotCall: query.doNotCall,
    });
    return {
      items: result.items.map((item) => CustomerResponseDto.fromRecord(item)),
      total: result.total,
      page: query.page,
      limit: query.limit,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  async getById(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromRecord(await this.customers.getById(id));
  }

  @Post(':id/outcome')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  async recordOutcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RecordCustomerOutcomeDto,
  ): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromRecord(await this.customers.recordOutcome(id, input.outcome));
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiConflictResponse({ description: 'Customer code already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromRecord(await this.customers.update(id, input));
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ status: 'ok' }> {
    await this.customers.remove(id);
    return { status: 'ok' };
  }
}
