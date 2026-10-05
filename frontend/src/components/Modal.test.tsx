// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

afterEach(cleanup);

// jsdom não calcula layout: sem isso offsetParent é sempre null e nenhum elemento "aparece" como focável.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', { get: () => document.body, configurable: true });

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      {open && (
        <Modal
          title="Nova lead"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <input aria-label="Nome" />
          <button>Salvar</button>
        </Modal>
      )}
    </>
  );
}

const openModal = () => {
  const opener = screen.getByText('abrir');
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('Modal', () => {
  it('tem papel de diálogo modal, nomeado pelo título', () => {
    render(<Harness />);
    openModal();
    const dialog = screen.getByRole('dialog', { name: 'Nova lead' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Nova lead' }).tagName).toBe('H2');
  });

  it('o foco vai para o primeiro campo ao abrir (não para o botão fechar)', () => {
    render(<Harness />);
    openModal();
    expect(document.activeElement).toBe(screen.getByLabelText('Nome'));
  });

  it('Esc fecha e devolve o foco a quem abriu', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = openModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('clicar fora fecha; clicar dentro não', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openModal();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.modal-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('o botão fechar tem nome acessível', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openModal();
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Tab no último controle volta ao primeiro, e Shift+Tab no primeiro vai ao último (foco preso)', () => {
    render(<Harness />);
    openModal();
    const items = [screen.getByLabelText('Nome'), screen.getByText('Salvar')];

    screen.getByText('Salvar').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // volta ao primeiro controle focável do diálogo (o botão Fechar vem antes do campo no DOM)
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(items[1]);

    const first = screen.getByLabelText('Fechar');
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(items[1]);
  });

  it('trava a rolagem da página enquanto aberto e restaura ao fechar', () => {
    render(<Harness />);
    expect(document.body.style.overflow).toBe('');
    openModal();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });

  it('com dois diálogos empilhados, Esc fecha só o de cima', () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Modal title="De baixo" onClose={closeBottom}>
          <button>a</button>
        </Modal>
        <Modal title="De cima" onClose={closeTop}>
          <button>b</button>
        </Modal>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });
});
