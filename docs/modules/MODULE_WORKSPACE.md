# Workspace Module

## Overview
Project and task management:
- Project creation and tracking
- Task management with assignments
- Document sharing and collaboration
- Time tracking
- Kanban boards
- Gantt charts
- Team collaboration

**Location**: `erp_backend/apps/workspace/` + `src/app/(privileged)/workspace/`

## Features
- **Projects**: Create and manage projects with milestones
- **Tasks**: Assign tasks with due dates and priorities
- **Time Tracking**: Log hours worked on tasks
- **Documents**: Upload and share project documents
- **Kanban Boards**: Visual task management
- **Gantt Charts**: Project timeline visualization
- **Team Chat**: Built-in team communication
- **Notifications**: Real-time task updates

## Models

### Project
Project container.

**Key Fields**:
- `name` - Project name
- `description` - Project details
- `start_date`, `end_date` - Project timeline
- `status` - PLANNING, IN_PROGRESS, COMPLETED
- `owner` - Project manager
- `team_members` - Assigned team

### Task
Individual task.

**Key Fields**:
- `project` - Parent project
- `title` - Task title
- `description` - Task details
- `assigned_to` - Assigned user
- `due_date` - Deadline
- `priority` - LOW, MEDIUM, HIGH
- `status` - TODO, IN_PROGRESS, DONE
- `estimated_hours` - Time estimate
- `actual_hours` - Time logged

### TimeEntry
Time tracking.

**Key Fields**:
- `task` - Related task
- `user` - User who logged time
- `date` - Work date
- `hours` - Hours worked
- `description` - Work description

## API Endpoints

### GET /api/workspace/projects/
List projects.

### POST /api/workspace/tasks/
Create task.

### POST /api/workspace/time-entries/
Log time.

---

**Last Updated**: 2026-03-14
**Status**: Production Ready
