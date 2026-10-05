import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [TasksModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
