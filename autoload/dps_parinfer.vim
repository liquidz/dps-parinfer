let s:debug = v:false
let s:visual_start_line = v:null
let s:insert_mode_after_blockwise_visual_mode = v:false
let s:debounce_keys = {}

let g:dps_parinfer#delay = get(g:, 'dps_parinfer#delay', 10)

function! s:debounce(key, delay_msec, fn) abort
  let timer = get(s:debounce_keys, a:key)
  silent! call timer_stop(timer)
  let s:debounce_keys[a:key] = timer_start(a:delay_msec, a:fn)
endfunction

function! s:get_top_form_pos() abort
  let v = winsaveview()
  let current_line = line('.')

  try
    if s:visual_start_line != v:null && s:visual_start_line < current_line
      call cursor(s:visual_start_line, 0)
    endif

    let start = search('^\S', 'bcnW')
    if (start != 0)
      call cursor(start - 1, 0)
      let start = search('^\S', 'bcnW')
      call cursor(v['lnum'], 0)
    endif
    " let end = search('^\S', 'nW')
    " if (end != 0)
    "   call cursor(end + 1, 0)
    "   let end = search('^\S', 'nW')
    " endif

    " return {
    "      \ 'start': (start == 0) ? 1 : start,
    "      \ 'end': (end == 0) ? '$' : end - 1,
    "      \ }
    return {'start': (start == 0) ? 1 : start, 'end': '$'}
  finally
    call winrestview(v)
  endtry
endfunction

function! s:update_curpos() abort
  let tpos = s:get_top_form_pos()
  let w:dps_parinfer_prevpos = getcurpos()
  let w:dps_start_line = tpos['start']
  let w:dps_end_line = tpos['end']

  if s:debug | echom printf('Debug: update_curpos %s', tpos) | endif
endfunction

function! s:update_text() abort
  let w:dps_parinfer_prev_text = join(getline(w:dps_start_line, w:dps_end_line), "\n")
endfunction

function! s:update_all() abort
  call s:update_curpos()
  call s:update_text()
endfunction

function! dps_parinfer#set_debug(is_debug) abort
  let s:debug = a:is_debug
endfunction

function! dps_parinfer#buf_enter(name) abort
  call s:update_all()
  return denops#notify(a:name, 'setBufferOption', [&filetype, {
        \ 'commentChars': get(b:, 'dps_parinfer_comment_chars', v:null),
        \ 'openParenChars': get(b:, 'dps_parinfer_open_paren_chars', v:null),
        \ 'closeParenChars': get(b:, 'dps_parinfer_close_paren_chars', v:null),
        \ }])
endfunction

function! dps_parinfer#mode_changed(name) abort
  let s:insert_mode_after_blockwise_visual_mode = v:false
  if v:event['new_mode'] =~ '^[vV]'
    let s:visual_start_line = line('.')
  elseif v:event['old_mode'] =~ '^[vV]'
    let s:visual_start_line = v:null

    " NOTE: Detect 'insert' mode after blockwise visual mode
    if v:event['old_mode'] ==# '' && v:event['new_mode'] ==# 'i'
      let s:insert_mode_after_blockwise_visual_mode = v:true
    endif
  endif
endfunction

function! dps_parinfer#cursor_moved(name) abort
  if ! exists('b:last_changedtick')
    let b:last_changedtick = b:changedtick
  endif
  if b:last_changedtick == b:changedtick
    call s:update_all()
  endif
endfunction

function! dps_parinfer#win_enter(name) abort
  call s:update_all()
endfunction

function s:error(ex) abort
  if s:debug
    echom printf('%s', a:ex)
  endif
endfunction

function! dps_parinfer#apply(name) abort
  if ! exists('b:last_changedtick')
    let b:last_changedtick = -1
  endif

  if b:last_changedtick != b:changedtick && ! s:insert_mode_after_blockwise_visual_mode
    let b:last_changedtick = b:changedtick

    if ! exists('w:dps_start_line')
      call s:update_curpos()
    endif
    let curpos = getcurpos()
    let lines = getline(w:dps_start_line, w:dps_end_line)

    return s:debounce('applyToBuffeer', g:dps_parinfer#delay, {_ ->
          \ denops#request_async(a:name, 'applyToBuffer',
          \   [&filetype, curpos[1], curpos[2], w:dps_parinfer_prevpos[1], w:dps_parinfer_prevpos[2], w:dps_start_line, w:dps_parinfer_prev_text, lines],
          \   {_ -> s:update_all()},
          \   {ex -> s:error(ex)})})
  endif
endfunction
