import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorlistComponent } from './errorlist.component';

describe('ErrorlistComponent', () => {
  let component: ErrorlistComponent;
  let fixture: ComponentFixture<ErrorlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorlistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErrorlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
