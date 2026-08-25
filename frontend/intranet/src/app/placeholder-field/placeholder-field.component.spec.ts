import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaceholderFieldComponent } from './placeholder-field.component';

describe('PlaceholderFieldComponent', () => {
  let component: PlaceholderFieldComponent;
  let fixture: ComponentFixture<PlaceholderFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceholderFieldComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaceholderFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
