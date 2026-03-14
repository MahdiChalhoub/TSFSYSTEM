# Workforce Module

## Overview
Employee performance scoring, gamification, and workforce analytics. Tracks employee achievements, scores, badges, and performance metrics across the organization.

## Key Features
- Performance scoring rules engine
- Employee score tracking and leaderboards
- Badge and achievement system
- Gamification for sales, support, operations
- Performance periods (daily, weekly, monthly)
- Automated score calculations
- Workforce analytics and dashboards

## Core Models
- **ScoreRule**: Defines what triggers points
- **EmployeeScoreEvent**: Individual scoring events
- **EmployeeScoreSummary**: Aggregated scores by period
- **EmployeeBadge**: Achievements and badges
- **EmployeeScorePeriod**: Performance tracking periods

## API Endpoints
- GET `/api/workforce/scores/` - View employee scores
- POST `/api/workforce/rules/` - Create scoring rules
- GET `/api/workforce/leaderboard/` - Rankings
- GET `/api/workforce/badges/` - Earned badges

## Business Logic
- Automatically calculate scores based on rules
- Award badges when thresholds met
- Reset scores per period
- Gamification rules configurable

## Dependencies
- Depends on: core, hr
- Consumes events from: sales, crm, pos (for scoring)

**Last Updated**: 2026-03-14
**Module Status**: Production
