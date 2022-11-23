" let g:dps_parinfer_delay = get(g:, 'dps_parinfer_delay', 0)
" let s:timer = 0

function! s:update_curpos() abort
  let w:dps_parinfer_curpos = getcurpos()
endfunction

function! s:update_text() abort
  let w:dps_parinfer_text = join(getline(1, '$'), "\n")
endfunction

function! s:update_all() abort
  call s:update_curpos()
  call s:update_text()
endfunction

function! dps_parinfer#buf_enter(name) abort
  call s:update_all()
  return denops#notify(a:name, 'setOption', [&filetype, {
        \ 'commentChars': get(b:, 'dps_parinfer_comment_chars', v:null),
        \ 'openParenChars': get(b:, 'dps_parinfer_open_paren_chars', v:null),
        \ 'closeParenChars': get(b:, 'dps_parinfer_close_paren_chars', v:null),
        \ 'forceBalance': get(g:, 'dps_parinfer_force_balance', v:null),
        \ 'partialResult': get(g:, 'dps_parinfer_partial_result', v:null),
        \ }])
endfunction

function! dps_parinfer#cursor_moved(name) abort
  return s:update_curpos()
endfunction

function! dps_parinfer#win_enter(name) abort
  call s:update_all()
endfunction


function! dps_parinfer#apply(name) abort
  if ! exists('b:last_changedtick')
    let b:last_changedtick = -1
  endif

  if b:last_changedtick != b:changedtick
    let b:last_changedtick = b:changedtick
    " silent! call timer_stop(s:timer)
    " let s:timer = timer_start(g:dps_parinfer_delay, { ->
    "      \ denops#request_async(a:name, 'applyToBuffer', [&filetype],
    "      \                      {_ -> s:update_all()},
    "      \                      {_ -> v:null})})
    return denops#request_async(a:name, 'applyToBuffer', [&filetype],
          \ {_ -> s:update_all()},
          \ {_ -> v:null})
  endif
endfunction
