import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { GetUserTokenVersionQuery } from './get-user-token-version.query';

@QueryHandler(GetUserTokenVersionQuery)
export class GetUserTokenVersionHandler implements IQueryHandler<
  GetUserTokenVersionQuery,
  number | null
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId }: GetUserTokenVersionQuery): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    return user?.tokenVersion ?? null;
  }
}
