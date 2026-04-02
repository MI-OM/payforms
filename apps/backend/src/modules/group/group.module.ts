import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { Contact } from '../contact/entities/contact.entity';
import { GroupService } from './services/group.service';
import { GroupController } from './controllers/group.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Group, Contact])],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
