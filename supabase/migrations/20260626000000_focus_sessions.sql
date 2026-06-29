-- Create focus_sessions table
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER NOT NULL DEFAULT 0,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('focus', 'short_break', 'long_break')),
    completion_status VARCHAR(20) NOT NULL CHECK (completion_status IN ('completed', 'interrupted')),
    completed_cycles INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for focus_sessions
CREATE POLICY "Users can insert their own focus sessions."
    ON public.focus_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own focus sessions."
    ON public.focus_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own focus sessions."
    ON public.focus_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- RPC Function to get aggregated focus stats
CREATE OR REPLACE FUNCTION get_focus_stats(p_user_id UUID, p_tz_offset_minutes INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_focus_time INTEGER;
    v_today_focus_time INTEGER;
    v_weekly_focus_time INTEGER;
    v_sessions_completed INTEGER;
    v_average_duration FLOAT;
    v_streak INTEGER := 0;
    v_last_date DATE;
    v_current_date DATE;
    v_date DATE;
    v_dates DATE[];
    v_offset INTERVAL;
BEGIN
    v_offset := (p_tz_offset_minutes * interval '1 minute');

    -- Total focus time (only focus sessions)
    SELECT COALESCE(SUM(duration), 0) INTO v_total_focus_time
    FROM public.focus_sessions
    WHERE user_id = p_user_id AND session_type = 'focus';

    -- Today's focus time
    SELECT COALESCE(SUM(duration), 0) INTO v_today_focus_time
    FROM public.focus_sessions
    WHERE user_id = p_user_id AND session_type = 'focus'
      AND DATE(start_time - v_offset) = DATE(now() - v_offset);

    -- Weekly focus time (last 7 days including today)
    SELECT COALESCE(SUM(duration), 0) INTO v_weekly_focus_time
    FROM public.focus_sessions
    WHERE user_id = p_user_id AND session_type = 'focus'
      AND DATE(start_time - v_offset) >= DATE(now() - v_offset) - 6;

    -- Sessions completed
    SELECT COUNT(*) INTO v_sessions_completed
    FROM public.focus_sessions
    WHERE user_id = p_user_id AND session_type = 'focus' AND completion_status = 'completed';

    -- Average duration
    IF v_sessions_completed > 0 THEN
        SELECT COALESCE(AVG(duration), 0) INTO v_average_duration
        FROM public.focus_sessions
        WHERE user_id = p_user_id AND session_type = 'focus' AND completion_status = 'completed';
    ELSE
        v_average_duration := 0;
    END IF;

    -- Streak (consecutive days with at least one completed focus session)
    SELECT ARRAY_AGG(DISTINCT DATE(start_time - v_offset) ORDER BY DATE(start_time - v_offset) DESC)
    INTO v_dates
    FROM public.focus_sessions
    WHERE user_id = p_user_id AND session_type = 'focus' AND completion_status = 'completed';

    v_current_date := DATE(now() - v_offset);
    v_streak := 0;

    IF v_dates IS NOT NULL AND array_length(v_dates, 1) > 0 THEN
        IF v_dates[1] = v_current_date OR v_dates[1] = v_current_date - 1 THEN
            v_streak := 1;
            v_last_date := v_dates[1];
            FOR i IN 2..array_length(v_dates, 1) LOOP
                IF v_dates[i] = v_last_date - 1 THEN
                    v_streak := v_streak + 1;
                    v_last_date := v_dates[i];
                ELSE
                    EXIT;
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN json_build_object(
        'totalFocusTime', v_total_focus_time,
        'todayFocusTime', v_today_focus_time,
        'weeklyFocusTime', v_weekly_focus_time,
        'sessionsCompleted', v_sessions_completed,
        'averageDuration', v_average_duration,
        'currentStreak', v_streak
    );
END;
$$;
